package com.github.meldmy.route;

import java.util.NavigableMap;
import java.util.Random;

public class GroupNameReceiver {

  private static final int MAX_WEIGHT_SUM = 100;
  private final Random randomGenerator;
  private final NavigableMap<Integer, String> weightedGroups;

  public GroupNameReceiver(NavigableMap<Integer, String> weightedGroups) {
    this.weightedGroups = weightedGroups;
    this.randomGenerator = new Random();
  }

  public String getNextGroupName() {
    var rnd = randomGenerator.nextInt(MAX_WEIGHT_SUM);
    return weightedGroups.ceilingEntry(rnd).getValue();
  }
}