# Weighted sticky load balancer [![Build Status](https://travis-ci.org/meldmy/weighted-sticky-load-balancer.svg?branch=master)](https://travis-ci.org/meldmy/weighted-sticky-load-balancer) [![Coverage Status](https://coveralls.io/repos/github/meldmy/weighted-sticky-load-balancer/badge.svg?branch=master)](https://coveralls.io/github/meldmy/weighted-sticky-load-balancer?branch=master)

This is simple REST load balancer that is able to route traffic to different backends depending on a hashed user id. Hashed user ids are mapped to group names that user falls into. To receive hash value from user id uses [MurmurHash3](https://en.wikipedia.org/wiki/MurmurHash#MurmurHash3)

Once we assign group to the user client connects to any backend server at any time, the user experience is unaffected. This is achieved by storing usernames mapped to assigned group name.

**Load balancer isn't session-aware** and stores hashed usernames in the HashMap to quickly receive a group name. That's why it can work with the system that doesn't store HTTP cookie and prevent unnesessary hashing.

**Load balancer uses WRR algorithm** to divide traffic between server groups.

![LoadBalancer](https://github.com/meldmy/weighted-sticky-load-balancer/blob/master/myLoadBalancer.jpg)

## API:
- **HTTP GET**: `/route?{id}`
- **HTTP response**: someGroupName

Example request:
`curl http://127.0.0.1:8899/route?id=meldmy`

## Default server settings:
- **host**: 127.0.0.1
- **port**: 8899
- **undertow.io-threads**: 8
- **undertow.worker-threads**: 16

IO threads perform non blocking tasks, when worker threads can.

To change default server settings - change need settings in the **`application.properties`**.

## Run program
1. Build an Docker image with current state of project by using:
```
./gradlew build docker
```

2. Run isolated container with already created project image:
```
docker run --rm -p 8899:8899 -t meldmy/weighted-sticky-load-balancer
```

Then project container process runs on a host :+1:

## Performance
For measuring performance was used [Apache JMeter](http://jmeter.apache.org) that currently is the leading open-source tool for load and performance testing.
By using [docker-jmeter](https://github.com/Droplr/docker-jmeter) exists opportunity to easily run JMeter tests without installing Java on your machine.

The performance test was started on the computer with the following characteristics:
- 2,7 GHz Intel Core i5
- 8 GB 1867 MHz DDR3. 

| HTTP Request | #Samples | KO | Error % | Average | Min | Max | Throughput | Received | Sent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HTTP GET | 704412 | 397 | 0.06% | 60.92 | 0 | 3223 | 7109.89 | 1015.23 | 949.87 |

Throughput is calculated as requests/unit of time. The time is calculated from the start of the first sample to the end of the last sample. This includes any intervals between samples, as it is supposed to represent the load on the server.
> The formula is: **Throughput = (number of requests) / (total time)**.

## Run performance test:
Following example show how to run performance test in the `./performance` folder and pass the parameter that is a folder where will be stored performance test report:

```
bash runPerformanceTest.sh '/pathToFolderWithReport/weighted-sticky-load-balancer/performance'
```

Test results and charts will be created after the test is completed in the **`./performance/report`** folder.

For the following test execution you should remove useless files before the test starts. To automate this use the following command:
 
`rm -f logFile.jtl && rm -dfr report/ && jmeter -n -t PerformanceTestPlan.jmx -l logFile.jtl -e -o report/`

