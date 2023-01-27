#!/bin/bash

eval $(aws ecr get-login-password --profile $AWS_PROFILE --region us-east-1 | sed 's|https://||')

docker build -t dev-mode-extension .

docker tag dev-mode-extension:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/dev-mode-extension:latest

echo "PUSHING...."
docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/dev-mode-extension:latest
echo "DONE"