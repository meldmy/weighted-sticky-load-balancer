package com.github.meldmy.configuration;

import static com.google.common.hash.Hashing.murmur3_128;
import static java.lang.Integer.parseInt;

import com.github.meldmy.configuration.init.GroupPoolInitializer;
import com.github.meldmy.route.GroupNameReceiver;
import com.github.meldmy.route.GroupRouter;
import com.github.meldmy.route.hash.UserIdHasher;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.undertow.UndertowServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

/**
 * @author Dmytro Melnychuk
 */
@Configuration
@PropertySource("classpath:application.properties")
public class AppConfig {

  @Value("${server.host}")
  public String host;
  @Value("#{${groups.weight}}")
  private Map<String, Integer> weightPerGroup;
  @Value("${server.undertow.port}")
  private String serverUndertowPort;

  @Bean
  public GroupRouter groupRouter() {
    var hasher = new UserIdHasher(murmur3_128());
    return new GroupRouter(weightedGroupReceiver(), hasher);
  }

  @Bean
  public GroupNameReceiver weightedGroupReceiver() {
    var groupPoolInitializer = new GroupPoolInitializer(weightPerGroup);
    var weightedGroups = groupPoolInitializer.initAndGetWeightedGroups();
    return new GroupNameReceiver(weightedGroups);
  }

  @Bean
  public UndertowServletWebServerFactory embeddedServletContainerFactory() {
    var factory = new UndertowServletWebServerFactory();
    setListenerHostAndPort(factory);
    return factory;
  }

  private void setListenerHostAndPort(UndertowServletWebServerFactory factory) {
    factory.addBuilderCustomizers(builder ->
        builder.addHttpListener(parseInt(serverUndertowPort), host));
  }
}