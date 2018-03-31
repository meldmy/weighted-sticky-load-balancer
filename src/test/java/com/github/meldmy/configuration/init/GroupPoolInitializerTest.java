package com.github.meldmy.configuration.init;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.Assertions.entry;

import com.google.common.collect.ImmutableMap;
import org.junit.Test;

/**
 * @author Dmytro Melnychuk
 */
public class GroupPoolInitializerTest {

  private GroupPoolInitializer givenGroupPoolInitializer;

  @Test
  public void shouldInitializeAndGetWeightedGroups() {
    var weightPerGroup = ImmutableMap.of(
        "A", 20,
        "B", 30,
        "C", 20,
        "D", 30
    );
    givenGroupPoolInitializer = new GroupPoolInitializer(weightPerGroup);
    var weightedGroups = givenGroupPoolInitializer.initAndGetWeightedGroups();

    assertThat(weightedGroups).contains(entry(20, "A"));
    assertThat(weightedGroups).contains(entry(50, "B"));
    assertThat(weightedGroups).contains(entry(70, "C"));
    assertThat(weightedGroups).contains(entry(100, "D"));
  }

  @Test
  public void shouldThrowExceptionWhenWeightSumIsMoreThanAvailable() {
    var weightPerGroup = ImmutableMap.of("A", 101);
    givenGroupPoolInitializer = new GroupPoolInitializer(weightPerGroup);

    var thrownException = catchThrowable(givenGroupPoolInitializer::initAndGetWeightedGroups);

    assertThat(thrownException).isInstanceOf(IllegalArgumentException.class);
  }

}