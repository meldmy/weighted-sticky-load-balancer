package com.github.meldmy.route;

import com.google.common.hash.HashFunction;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static java.nio.charset.StandardCharsets.UTF_8;


/**
 * @author Dmytro Melnychuk
 */
public class GroupRouter {

    private static final Map<Long, String> USERS_HASH_PER_GROUP = new ConcurrentHashMap<>();
    private final HashFunction stringHashFunction;
    private final GroupNameReceiver groupNameReceiver;

    public GroupRouter(HashFunction stringHashFunction, GroupNameReceiver groupNameReceiver) {
        this.stringHashFunction = stringHashFunction;
        this.groupNameReceiver = groupNameReceiver;
    }

    public String receiveGroupName(String userId) {
        long hashedUserId = hashUserId(userId);
        return isPreviouslyStoredUserId(hashedUserId)
                ? getPreviouslyStoredUserId(hashedUserId)
                : putAndGetGroupName(hashedUserId);
    }

    private long hashUserId(String userId) {
        return stringHashFunction
                .hashString(userId, UTF_8)
                .asLong();
    }

    private String getPreviouslyStoredUserId(long hashedUserId) {
        return USERS_HASH_PER_GROUP.get(hashedUserId);
    }

    private String putAndGetGroupName(long hashedUserId) {
        String groupName = groupNameReceiver.getNextGroupName();
        USERS_HASH_PER_GROUP.put(hashedUserId, groupName);
        return groupName;
    }

    private boolean isPreviouslyStoredUserId(long hashedUserId) {
        return USERS_HASH_PER_GROUP.containsKey(hashedUserId);
    }
}