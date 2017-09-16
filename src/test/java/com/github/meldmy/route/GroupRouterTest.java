package com.github.meldmy.route;

import com.github.meldmy.route.hash.UserIdHasher;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.runners.MockitoJUnitRunner;

import static com.github.meldmy.util.TestDummies.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

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
        when(receiver.getNextGroupName()).thenReturn(DUMMY_FIRST_GROUP_NAME).thenReturn(DUMMY_SECOND_GROUP_NAME);

        String firstGroup = groupRouter.receiveGroupName(DUMMY_FIRST_USER_ID);
        String secondGroup = groupRouter.receiveGroupName(DUMMY_SECOND_USER_ID);

        assertThat(firstGroup).isNotEqualTo(secondGroup);
    }

    @Test
    public void shouldReturnTheSameGroupForPersistedUser() {
        when(hasher.hash(DUMMY_FIRST_USER_ID)).thenReturn(DUMMY_HASHED_FIRST_USER_ID);
        when(receiver.getNextGroupName()).thenReturn(DUMMY_FIRST_GROUP_NAME);

        String firstUserGroup = groupRouter.receiveGroupName(DUMMY_FIRST_USER_ID);
        String secondUserGroup = groupRouter.receiveGroupName(DUMMY_FIRST_USER_ID);

        assertThat(firstUserGroup).isEqualTo(secondUserGroup);
    }

}