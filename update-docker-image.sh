#!/bin/bash
IMAGE_NAME="project-grading"
AWS_ACCOUNT_NUMBER=`aws sts get-caller-identity --output text --query 'Account'`
IMAGE_PATH="$AWS_ACCOUNT_NUMBER.dkr.ecr.us-east-1.amazonaws.com/$IMAGE_NAME"

dopush(){
    dologin
    docker push $IMAGE_PATH
}

dopull(){
    dologin
    docker pull $IMAGE_PATH
}

dologin(){
    DOCKER_LOGIN_COMMAND=`aws ecr get-login --no-include-email`
    eval $DOCKER_LOGIN_COMMAND
}

docreate() {
    aws ecr describe-repositories --repository-names $IMAGE_NAME || \
        aws ecr create-repository --repository-name $IMAGE_NAME
}

dobuild () {
    docker build -t $IMAGE_PATH .
}

ACTION=$1
case $ACTION in
    push)
        dobuild
        dopush
        ;;
    pull)
        dopull
        ;;
    build)
        dobuild
        ;;
    *)
        echo "Invalid action! Must be build, push, or pull"
        exit
        ;;
esac

