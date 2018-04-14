package com.github.meldmy.configuration;

import static com.github.meldmy.util.TestDummies.SOME_WEIGHTED_GROUPS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.util.ReflectionTestUtils.setField;

import com.github.meldmy.route.GroupNameReceiver;
import java.util.Random;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

/**
 * @author Dmytro Melnychuk
 */
@RunWith(MockitoJUnitRunner.class)
public class GroupNameReceiverTest {

  @Mock
  private Random randomGenerator;
  @InjectMocks
  private GroupNameReceiver groupNameReceiver;

  @Before
  public void setUp() {
    groupNameReceiver = new GroupNameReceiver(SOME_WEIGHTED_GROUPS);
    setField(groupNameReceiver, "randomGenerator", randomGenerator);
  }

  @Test
  public void shouldReturnRandomNextGroupName() {
    var firstRandom = 15;
    var secondRandom = 40;
    var expectedFirstGroupName = "A";
    var expectedSecondGroupName = "B";
    when(randomGenerator.nextInt(anyInt())).thenReturn(firstRandom).thenReturn(secondRandom);

    assertThat(groupNameReceiver.getNextGroupName()).isEqualTo(expectedFirstGroupName);
    assertThat(groupNameReceiver.getNextGroupName()).isEqualTo(expectedSecondGroupName);
  }
}