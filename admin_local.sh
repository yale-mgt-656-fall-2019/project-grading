#!/bin/bash
#set -x
#set -v
IMAGE_NAME="project-grading"
IMAGE_PATH="$IMAGE_NAME"

dobuild () {
    docker build -t $IMAGE_PATH .
}

dorun (){
    if [ "$#" -ne 3 ]; then
        echo "Need 3 parameters but got $#"
        exit
    fi
    export IMG=$IMAGE_PATH
    docker-compose run test $*
}

shell (){
    export IMG=$IMAGE_PATH
    docker-compose run --entrypoint /bin/sh test
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
    create)
        docreate
        ;;
    run)
        dorun $2 $3 $4
        ;;
    shell)
        shell
        ;;
    *)
        echo "Invalid action! Must be build, push, or pull"
        exit
        ;;
esac
