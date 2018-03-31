package com.github.meldmy.route;

import com.github.meldmy.route.hash.UserIdHasher;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;


/**
 * @author Dmytro Melnychuk
 */
public class GroupRouter {

  private final UserIdHasher hasher;
  private final GroupNameReceiver groupNameReceiver;
  private final Map<Long, String> usersHashPerGroup;

  public GroupRouter(GroupNameReceiver groupNameReceiver, UserIdHasher hasher) {
    this.hasher = hasher;
    this.groupNameReceiver = groupNameReceiver;
    usersHashPerGroup = new ConcurrentHashMap<>();
  }

  public String receiveGroupName(String userId) {
    var hashedUserId = hasher.hash(userId);
    return receiveGroupName(hashedUserId);
  }

  private String receiveGroupName(long hashedUserId) {
    return isPreviouslyStoredUserId(hashedUserId)
        ? getPreviouslyStoredUserId(hashedUserId)
        : putAndGetGroupName(hashedUserId);
  }

  private String getPreviouslyStoredUserId(long hashedUserId) {
    return usersHashPerGroup.get(hashedUserId);
  }

  private String putAndGetGroupName(long hashedUserId) {
    var groupName = groupNameReceiver.getNextGroupName();
    usersHashPerGroup.put(hashedUserId, groupName);
    return groupName;
  }

  private boolean isPreviouslyStoredUserId(long hashedUserId) {
    return usersHashPerGroup.containsKey(hashedUserId);
  }
}