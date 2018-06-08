#!/bin/sh

timestamp=$(date +%Y%m%d_%H%M%S)
outputForTest=$1
#TODO:// change container to newer JMeter version that will support JDK-10
docker run \
    --rm \
    --network="host" \
	--name jmeter_performance \
	-v $outputForTest:/jmeter \
	-t droplr/jmeter \
	-n \
	-t "PerformanceTestPlan.jmx" \
	-j $outputForTest/result/jmeter_$timestamp \
	-l $outputForTest/result/result_$timestamp.jtl \
	-e \
	-o report__$(date +%Y%m%d_%H%M%S)/


#sudo bash runPerformanceTest.sh '/Users/{username}/IdeaProjects/weighted-sticky-load-balancer/performance'
