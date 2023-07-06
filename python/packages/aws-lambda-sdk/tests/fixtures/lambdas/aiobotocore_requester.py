import sys
from pathlib import Path
import asyncio
from botocore.client import Config
from botocore import UNSIGNED


async def get_s3_object():
    bucket = "cloudformation-examples-us-east-1"
    key = "cloudformation_graphic.png"

    from aiobotocore.session import get_session

    session = get_session()
    async with session.create_client(
        "s3",
        region_name="us-east-1",
        config=Config(signature_version=UNSIGNED),
    ) as client:
        resp = await client.get_object(Bucket=bucket, Key=key)
        body = await resp["Body"].read()
        if not len(body) > 0:
            raise Exception("Unable to read data from the response")


def handler(event, context) -> str:
    sys.path.append(str(Path(__file__).parent / "test_dependencies"))
    asyncio.run(get_s3_object())
    sys.path.pop()
    return "ok"


if __name__ == "__main__":
    handler({}, None)
