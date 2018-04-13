package com.github.meldmy.route;

import static java.util.Optional.ofNullable;

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
    var groupName = groupNameReceiver.getNextGroupName();
    return ofNullable(usersHashPerGroup.putIfAbsent(hashedUserId, groupName)).orElse(groupName);
  }
}