#!/bin/sh

timestamp=$(date +%Y%m%d_%H%M%S)
#TODO:// change container to JMeter 4.0
docker run \
     -v $1:/jmeter \
     -t droplr/jmeter \
     -n \
     -t "PerformanceTestPlan.jmx" \
     -j ./result/jmeter_$timestamp \
     -l ./result/result_$timestamp.jtl \
     -e \
     -o report__$(date +%Y%m%d_%H%M%S)/



#sudo docker run -v c:/Users/Dmytro-PC/tmp:/jmeter -t droplr/jmeter -n -t PerformanceTestPlan.jmx -j ./result/jmeter_$(date +%Y%m%d_%H%M%S) -l ./result/result_$(date +%Y%m%d_%H%M%S).jtl -e -o report__$(date +%Y%m%d_%H%M%S)/
