package com.github.meldmy.entity;

import java.util.Map.Entry;

/**
 * @author Dmytro Melnychuk
 */
public class ServerDetails {

  private final String groupName;
  private final int weight;

  public ServerDetails(Entry<String, Integer> weightedGroupEntry) {
    this(weightedGroupEntry.getKey(), weightedGroupEntry.getValue());
  }

  private ServerDetails(String groupName, int weight) {
    this.groupName = groupName;
    this.weight = weight;
  }

  public String getGroupName() {
    return groupName;
  }

  public int getWeight() {
    return weight;
  }

  @Override
  public String toString() {
    return groupName + ":" + weight;
  }
}
