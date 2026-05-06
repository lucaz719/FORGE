import os, httpx, random, asyncio
from dotenv import load_dotenv

load_dotenv()

AMD_API_KEY  = os.getenv("AMD_API_KEY", "")
AMD_API_BASE = os.getenv("AMD_API_BASE", "https://api.amd.com/v1")
AMD_MODEL    = os.getenv("AMD_MODEL", "meta-llama/Llama-3.1-8B-Instruct")

INSTANCE_BASE_PRICES = {
    "MI300X": 3.50,
    "MI250X": 2.20,
    "MI100":  1.10,
}

class AMDClient:
    def __init__(self):
        self.use_real = bool(AMD_API_KEY)
        self._last_prices: dict[str, float] = {}

    async def run_inference(self, prompt: str, model: str = "") -> dict:
        """Run inference. Returns real AMD response or mock."""
        model = model or AMD_MODEL
        if self.use_real:
            return await self._real_inference(prompt, model)
        return await self._mock_inference(prompt, model)

    async def _real_inference(self, prompt: str, model: str) -> dict:
        headers = {
            "Authorization": f"Bearer {AMD_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 50,
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{AMD_API_BASE}/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def _mock_inference(self, prompt: str, model: str) -> dict:
        await asyncio.sleep(0.5)  # simulate latency
        return {
            "id": f"mock-{random.randint(10000,99999)}",
            "object": "chat.completion",
            "model": model,
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": f"[FORGE MOCK] Inference complete for: {prompt[:60]}..."
                },
                "finish_reason": "stop",
                "index": 0
            }],
            "usage": {"prompt_tokens": 20, "completion_tokens": 30, "total_tokens": 50},
            "_mock": True
        }

    async def get_spot_price(self, instance_type: str = "MI300X") -> float:
        """Returns current spot price with ±15% variance. Falls back to simulation if API unavailable."""
        base = INSTANCE_BASE_PRICES.get(instance_type, 3.50)
        if self.use_real:
            try:
                return await self._real_spot_price(instance_type)
            except Exception:
                pass
        variance = random.uniform(-0.15, 0.15)
        price = round(base * (1 + variance), 4)
        self._last_prices[instance_type] = price
        return price

    async def _real_spot_price(self, instance_type: str) -> float:
        """Attempt real AMD pricing endpoint. May not be available — caller catches exceptions."""
        headers = {"Authorization": f"Bearer {AMD_API_KEY}"}
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{AMD_API_BASE}/pricing/{instance_type}", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return float(data.get("spot_price", INSTANCE_BASE_PRICES.get(instance_type, 3.50)))

    async def check_idle(self, instance_id: str) -> bool:
        """Returns True if instance is idle (mock: always returns True for 'renter-instance-01')."""
        if instance_id == "renter-instance-01":
            return True
        return False

    async def prewarm_instance(self, instance_type: str = "MI300X") -> str:
        """Pre-warm an instance for demo stability. Returns instance_id."""
        await asyncio.sleep(0.3)
        return f"{instance_type.lower()}-demo-prewarm-01"


amd_client = AMDClient()
