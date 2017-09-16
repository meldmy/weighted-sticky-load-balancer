package com.github.meldmy.util;

import java.util.NavigableMap;

import static com.google.common.collect.Maps.newTreeMap;

/**
 * @author Dmytro Melnychuk
 */
public class TestDummies {
    public static final String DUMMY_FIRST_GROUP_NAME = "someFirstGroup";
    public static final String DUMMY_SECOND_GROUP_NAME = "someSecondGroup";
    public static final long DUMMY_HASHED_FIRST_USER_ID = 1L;
    public static final long DUMMY_HASHED_SECOND_USER_ID = 2L;
    public static final String DUMMY_FIRST_USER_ID = "dummyFirstUserId";
    public static final String DUMMY_SECOND_USER_ID = "dummySecondUserId";
    public static final NavigableMap<Integer, String> SOME_WEIGHTED_GROUPS = getSomeWeightedGroups();

    private static NavigableMap<Integer, String> getSomeWeightedGroups() {
        NavigableMap<Integer, String> groups = newTreeMap();
        groups.put(20, "A");
        groups.put(50, "B");
        groups.put(70, "C");
        groups.put(100, "D");
        return groups;
    }
}
