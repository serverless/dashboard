import json
import logging
import os
import sys
import time

import requests


def hello(event, context):

    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)

    if event.get("exception"):
        logger.debug("exception")
        raise Exception
    elif event.get("exit"):
        logger.debug("exit")
        sys.exit(1)
    elif event.get("delay"):
        logger.debug("delay:start")
        time.sleep(10)
        logger.debug("delay:end")
    else:
        logger.debug("request:start")
        requests.get("http://neverssl.com/")
        logger.debug("request:end")

    body = {
        "message": "Go Serverless v3.0! Your function executed successfully!",
        "environ": dict(os.environ),
        "input": event,
    }

    return {"statusCode": 200, "body": json.dumps(body)}
