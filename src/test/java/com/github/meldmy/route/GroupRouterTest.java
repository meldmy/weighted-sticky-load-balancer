package com.github.meldmy.route;

import static com.github.meldmy.util.TestDummies.DUMMY_FIRST_GROUP_NAME;
import static com.github.meldmy.util.TestDummies.DUMMY_FIRST_USER_ID;
import static com.github.meldmy.util.TestDummies.DUMMY_HASHED_FIRST_USER_ID;
import static com.github.meldmy.util.TestDummies.DUMMY_HASHED_SECOND_USER_ID;
import static com.github.meldmy.util.TestDummies.DUMMY_SECOND_GROUP_NAME;
import static com.github.meldmy.util.TestDummies.DUMMY_SECOND_USER_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.github.meldmy.route.hash.UserIdHasher;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

/**
 * @author Dmytro Melnychuk
 */
@RunWith(MockitoJUnitRunner.class)
public class GroupRouterTest {

  @Mock
  private UserIdHasher hasher;
  @Mock
  private GroupNameReceiver receiver;
  @InjectMocks
  private GroupRouter groupRouter;

  @Test
  public void shouldReturnDifferentGroupsForDifferentUsers() {
    when(hasher.hash(DUMMY_FIRST_USER_ID)).thenReturn(DUMMY_HASHED_FIRST_USER_ID);
    when(hasher.hash(DUMMY_SECOND_USER_ID)).thenReturn(DUMMY_HASHED_SECOND_USER_ID);
    when(receiver.getNextGroupName()).thenReturn(DUMMY_FIRST_GROUP_NAME)
        .thenReturn(DUMMY_SECOND_GROUP_NAME);

    var firstGroup = groupRouter.receiveGroupName(DUMMY_FIRST_USER_ID);
    var secondGroup = groupRouter.receiveGroupName(DUMMY_SECOND_USER_ID);

    assertThat(firstGroup).isNotEqualTo(secondGroup);
  }

  @Test
  public void shouldReturnTheSameGroupForPersistedUser() {
    when(hasher.hash(DUMMY_FIRST_USER_ID)).thenReturn(DUMMY_HASHED_FIRST_USER_ID);
    when(receiver.getNextGroupName()).thenReturn(DUMMY_FIRST_GROUP_NAME);

    var firstUserGroup = groupRouter.receiveGroupName(DUMMY_FIRST_USER_ID);
    var secondUserGroup = groupRouter.receiveGroupName(DUMMY_FIRST_USER_ID);

    assertThat(firstUserGroup).isEqualTo(secondUserGroup);
  }

}