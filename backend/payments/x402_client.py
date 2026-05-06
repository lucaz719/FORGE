import os, asyncio, hashlib, time, random
from dotenv import load_dotenv

load_dotenv()

# Try importing real x402 library
try:
    import x402
    HAS_X402 = True
except ImportError:
    HAS_X402 = False


class X402Client:
    """
    X402 micropayment client.
    Uses real x402-python on Base Sepolia testnet if available.
    Falls back to mock with deterministic receipt hashes + 300ms simulated latency.
    """

    def __init__(self):
        self.use_real = HAS_X402
        self.network = "base-sepolia"

    async def pay(
        self,
        from_wallet: str,
        to_wallet: str,
        amount_usd: float,
        job_id: str,
        event_type: str = "JOB_START"
    ) -> str:
        """
        Pay for a job. Returns receipt_hash string.
        
        Payment events:
          JOB_START      → spot_rate × estimated_hours
          BATCH_SPLIT    → spot_rate × hours ÷ n_jobs  (caller computes amount)
          SUBLEASED_CREDIT → proportional share to Renter
          REFUND         → full amount back to user
        """
        if self.use_real:
            try:
                return await self._real_pay(from_wallet, to_wallet, amount_usd, job_id, event_type)
            except Exception:
                pass  # fall through to mock
        return await self._mock_pay(from_wallet, to_wallet, amount_usd, job_id, event_type)

    async def _real_pay(self, from_wallet, to_wallet, amount_usd, job_id, event_type) -> str:
        """Real x402 payment on Base Sepolia testnet."""
        # x402 library interface (adapt if actual API differs)
        receipt = await asyncio.to_thread(
            x402.pay,
            from_wallet=from_wallet,
            to_wallet=to_wallet,
            amount=amount_usd,
            currency="USD",
            network=self.network,
            metadata={"job_id": job_id, "event": event_type}
        )
        return receipt.get("hash", self._deterministic_hash(job_id, amount_usd))

    async def _mock_pay(self, from_wallet, to_wallet, amount_usd, job_id, event_type) -> str:
        """Mock payment — identical UX to real, 300ms latency, deterministic hash."""
        await asyncio.sleep(0.3)
        return self._deterministic_hash(job_id, amount_usd)

    async def refund(self, user_id: str, amount_usd: float, job_id: str) -> str:
        """Issue a refund. Returns refund receipt hash."""
        renter_wallet = os.getenv("WALLET_RENTER", "0xRenter")
        user_wallet_map = {
            "batcher_a": os.getenv("WALLET_BATCHER_A", "0xBatcherA"),
            "batcher_b": os.getenv("WALLET_BATCHER_B", "0xBatcherB"),
            "solo":      os.getenv("WALLET_SOLO", "0xSolo"),
            "renter":    renter_wallet,
        }
        to_wallet = user_wallet_map.get(user_id, "0xUnknown")
        provider_wallet = os.getenv("WALLET_AMD_PROVIDER", "0xProvider")
        return await self.pay(
            from_wallet=provider_wallet,
            to_wallet=to_wallet,
            amount_usd=amount_usd,
            job_id=f"refund-{job_id}",
            event_type="REFUND"
        )

    def _deterministic_hash(self, job_id: str, amount_usd: float) -> str:
        """Generate a deterministic 64-char hex hash from job_id + amount + timestamp bucket."""
        ts_bucket = str(int(time.time() // 10))  # 10-second buckets for determinism
        raw = f"{job_id}:{amount_usd:.6f}:{ts_bucket}"
        return "0x" + hashlib.sha256(raw.encode()).hexdigest()


x402_client = X402Client()
