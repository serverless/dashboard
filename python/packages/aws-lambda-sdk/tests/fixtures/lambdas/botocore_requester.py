import logging
import botocore.session


def handler(event, context) -> str:
    try:
        session = botocore.session.get_session()
        client = session.create_client("sts")
        client.get_caller_identity()
        return "ok"

    except Exception as ex:
        logging.info(ex)
        raise ex
