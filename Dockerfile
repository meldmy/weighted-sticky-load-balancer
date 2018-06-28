FROM ubuntu:latest

## Install Oracle JDK 10
RUN \
  apt-get update && \
  apt-get -y install software-properties-common && \
  add-apt-repository ppa:linuxuprising/java && \
  apt-get update && \
  echo oracle-java10-installer shared/accepted-oracle-license-v1-1 select true | /usr/bin/debconf-set-selections && \
  apt-get install -y oracle-java10-installer && \
  apt-get -y remove software-properties-common && \
  apt-get clean autoclean -y && \
  apt-get autoremove -y

VOLUME /tmp

ARG JAR_FILE
COPY ${JAR_FILE} app.jar

#To reduce Tomcat startup time we added a system property pointing to "/dev/urandom" as a source of entropy.
ENTRYPOINT ["java","-Djava.security.egd=file:/dev/./urandom","-jar","/app.jar"]