use std::{thread, time, env};
use std::sync::Mutex;
use std::collections::HashMap;
use lazy_static::lazy_static;
use serde_json::json;
use lambda_extension::{service_fn, Error, Extension, LambdaLog, LambdaLogRecord, SharedService, NextEvent, LambdaEvent, LogBuffering};

lazy_static! {
  static ref REQ_IDS: Mutex<HashMap<u32, String>> = Mutex::new(HashMap::new());
  static ref LOG_CHECK: Mutex<HashMap<u32, bool>> = Mutex::new(HashMap::new());
}

async fn my_extension(event: LambdaEvent) -> Result<(), Error> {
  match event.next {
    NextEvent::Shutdown(_e) => {
      // do something with the shutdown event
    }
    NextEvent::Invoke(_e) => {
      REQ_IDS.lock().unwrap().insert(0, _e.request_id);
      LOG_CHECK.lock().unwrap().insert(0, true);
      // Added a loop to wait for logs to come in
      // before closing the extension 
      loop {
        let sleep_time = time::Duration::from_millis(750);
        thread::sleep(sleep_time);
        if !LOG_CHECK.lock().unwrap().get(&0).unwrap() { break; }
        LOG_CHECK.lock().unwrap().insert(0, false);
      }
    }
  }
  Ok(())
}

async fn logs_extension(logs: Vec<LambdaLog>) -> Result<(), Error> {
  let mut messages = [].to_vec();
  let mut request_id = "".to_string();
  for log in logs {
    match log.record {
      LambdaLogRecord::Function(record) => {
        LOG_CHECK.lock().unwrap().insert(0, true);
        request_id = REQ_IDS.lock().unwrap().get(&0).unwrap().to_string();
        messages.push(json!({
          "message": record,
          "timestamp": log.time.timestamp_millis(),
          "sequence_id": "",
          "account_id": "",
          "request_id": request_id,
        }));
      },
      LambdaLogRecord::Extension(_record) => {
        LOG_CHECK.lock().unwrap().insert(0, true);
      }
      _ => (),
    }
  }

  let data = json!({
    "requestId": request_id,
    "traceId": "",
    "orgUid": env::var("SLS_ORG_ID").unwrap_or("".to_string()),
    "name": env::var("AWS_LAMBDA_FUNCTION_NAME").unwrap_or("".to_string()),
    "messages": messages,
  });

  let client = reqwest::Client::new();
  let _res = client.post(env::var("SLS_PUBLISH_ENDPOINT").unwrap_or("https://core.serverless.com/dev-mode/log-socket/publish".to_string()))
      .body(data.to_string())
      .send()
      .await?;
  
  Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
  // The runtime logging can be enabled here by initializing `tracing` with `tracing-subscriber`
  // While `tracing` is used internally, `log` can be used as well if preferred.
  tracing_subscriber::fmt()
    .with_max_level(tracing::Level::INFO)
    // disabling time is handy because CloudWatch will add the ingestion time.
    .without_time()
    .init();

  let func = service_fn(my_extension);
  let logs_processor = SharedService::new(service_fn(logs_extension));
  Extension::new()
    .with_events_processor(func)
    .with_logs_processor(logs_processor)
    .with_log_buffering(LogBuffering {
      timeout_ms: 25,
      max_bytes: 262144,
      max_items: 1000,
    })
    .run()
    .await
}