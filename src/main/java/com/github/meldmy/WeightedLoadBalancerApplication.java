package com.github.meldmy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan
public class WeightedLoadBalancerApplication {

	public static void main(String[] args) {
		SpringApplication.run(WeightedLoadBalancerApplication.class, args);
	}
}
