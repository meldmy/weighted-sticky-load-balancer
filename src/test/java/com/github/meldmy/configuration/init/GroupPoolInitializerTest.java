package com.github.meldmy.configuration.init;

import com.google.common.collect.ImmutableMap;
import org.junit.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;


/**
 * @author Dmytro Melnychuk
 */
public class GroupPoolInitializerTest {

    private GroupPoolInitializer givenGroupPoolInitializer;

    @Test
    public void shouldInitializeAndGetWeightedGroups() {
        Map<String, Integer> weightPerGroup = ImmutableMap.of(
                "A", 20,
                "B", 30,
                "C", 20,
                "D", 30
        );
        givenGroupPoolInitializer = new GroupPoolInitializer(weightPerGroup);
        Map<Integer, String> weightedGroups = givenGroupPoolInitializer.initAndGetWeightedGroups();

        assertThat(weightedGroups).contains(entry(20, "A"));
        assertThat(weightedGroups).contains(entry(50, "B"));
        assertThat(weightedGroups).contains(entry(70, "C"));
        assertThat(weightedGroups).contains(entry(100, "D"));
    }

    @Test
    public void shouldThrowExceptionWhenWeightSumIsMoreThanAvailable() {
        Map<String, Integer> weightPerGroup = ImmutableMap.of("A", 101);
        givenGroupPoolInitializer = new GroupPoolInitializer(weightPerGroup);

        Throwable thrownException = catchThrowable(givenGroupPoolInitializer::initAndGetWeightedGroups);

        assertThat(thrownException).isInstanceOf(IllegalArgumentException.class);
    }

}