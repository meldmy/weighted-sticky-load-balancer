package com.github.meldmy.route;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.util.NavigableMap;

import static com.google.common.collect.Maps.newTreeMap;
import static com.google.common.hash.Hashing.murmur3_128;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * @author Dmytro Melnychuk
 */
@RunWith(JUnit4.class)
public class GroupRouterTest {

    private GroupRouter groupRouter;

    @Test
    public void shouldReturnDifferentGroupsForDifferentUsers() {
        groupRouter = createSomeGroupRouter();
        String givenFirstUser = "user1";
        String givenSecondUser = "user2";

        String firstGroup = groupRouter.receiveGroupName(givenFirstUser);
        String secondGroup = groupRouter.receiveGroupName(givenSecondUser);

        assertThat(firstGroup).isNotEqualTo(secondGroup);
    }

    @Test
    public void shouldReturnTheSameGroupForPersistedUser() {
        groupRouter = createSomeGroupRouter();
        String givenFirstUser = "user1";

        String firstUserGroup = groupRouter.receiveGroupName(givenFirstUser);
        String secondUserGroup = groupRouter.receiveGroupName(givenFirstUser);

        assertThat(firstUserGroup).isEqualTo(secondUserGroup);
    }

    private static GroupRouter createSomeGroupRouter() {
        NavigableMap<Integer, String> groups = getSomeWeightedGroups();
        return new GroupRouter(murmur3_128(), new GroupNameReceiver(groups));
    }

    public static NavigableMap<Integer, String> getSomeWeightedGroups() {
        NavigableMap<Integer, String> groups = newTreeMap();
        groups.put(20, "A");
        groups.put(50, "B");
        groups.put(70, "C");
        groups.put(100, "D");
        return groups;
    }

}