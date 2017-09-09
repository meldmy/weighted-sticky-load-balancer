package com.github.meldmy.configuration;

import com.github.meldmy.route.GroupNameReceiver;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.runners.MockitoJUnitRunner;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Random;

import static com.github.meldmy.route.GroupRouterTest.getSomeWeightedGroups;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Matchers.anyInt;
import static org.mockito.Mockito.when;

/**
 * @author Dmytro Melnychuk
 */
@RunWith(MockitoJUnitRunner.class)
public class GroupNameReceiverTest {

    @Mock private Random randomGenerator;
    @InjectMocks private GroupNameReceiver groupNameReceiver;

    @Before
    public void setUp() {
        groupNameReceiver = new GroupNameReceiver(getSomeWeightedGroups());
        ReflectionTestUtils.setField(groupNameReceiver, "randomGenerator", randomGenerator);
    }

    @Test
    public void shouldReturnRandomNextGroupName() {
        int firstRandom = 15;
        int secondRandom = 40;
        String expectedFirstGroupName = "A";
        String expectedSecondGroupName = "B";
        when(randomGenerator.nextInt(anyInt())).thenReturn(firstRandom).thenReturn(secondRandom);

        assertThat(groupNameReceiver.getNextGroupName()).isEqualTo(expectedFirstGroupName);
        assertThat(groupNameReceiver.getNextGroupName()).isEqualTo(expectedSecondGroupName);
    }
}