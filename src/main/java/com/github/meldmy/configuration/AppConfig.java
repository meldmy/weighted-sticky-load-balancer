package com.github.meldmy.configuration;

import com.github.meldmy.configuration.init.GroupPoolInitializer;
import com.github.meldmy.route.GroupNameReceiver;
import com.github.meldmy.route.GroupRouter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.embedded.undertow.UndertowEmbeddedServletContainerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;
import java.util.NavigableMap;

import static com.google.common.hash.Hashing.murmur3_128;
import static java.lang.Integer.parseInt;

/**
 * @author Dmytro Melnychuk
 */
@Configuration
public class AppConfig {

    @Value("#{${groups.weight}}")
    private Map<String, Integer> weightPerGroup;

    @Value("${server.port}")
    private String serverPort;

    @Value("${server.host}")
    public String host;

    @Bean
    public GroupRouter groupRouter(){
        return new GroupRouter(murmur3_128(), weightedGroupReceiver());
    }

    @Bean
    public GroupNameReceiver weightedGroupReceiver(){
        GroupPoolInitializer groupPoolInitializer = new GroupPoolInitializer(weightPerGroup);
        NavigableMap<Integer, String> weightedGroups = groupPoolInitializer.initAndGetWeightedGroups();
        return new GroupNameReceiver(weightedGroups);
    }

    @Bean
    public UndertowEmbeddedServletContainerFactory embeddedServletContainerFactory() {
        UndertowEmbeddedServletContainerFactory factory = new UndertowEmbeddedServletContainerFactory();
        setListenerHostAndPort(factory);
        return factory;
    }

    private void setListenerHostAndPort(UndertowEmbeddedServletContainerFactory factory) {
        factory.addBuilderCustomizers(builder ->
                builder.addHttpListener(parseInt(serverPort), host));
    }
}