package com.github.meldmy.configuration.init;

import static com.google.common.base.Preconditions.checkArgument;
import static java.util.stream.Collectors.toCollection;
import static java.util.stream.Collectors.toList;

import com.github.meldmy.entity.ServerDetails;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Predicate;


/**
 * @author Dmytro Melnychuk
 */
public class GroupPoolInitializer {

  private static final int MAX_WEIGHT_SUM = 100;
  private final Map<String, Integer> weightPerGroup;


  public GroupPoolInitializer(Map<String, Integer> weightPerGroup) {
    this.weightPerGroup = weightPerGroup;
  }


  public NavigableMap<Integer, String> initAndGetWeightedGroups() {
    Set<ServerDetails> serverPool = receiveServerPool();
    checkWeightParameters(serverPool);
    return receiveWeightedGroups(serverPool);
  }


  private Set<ServerDetails> receiveServerPool() {
    return weightPerGroup.entrySet()
        .stream()
        .map(ServerDetails::new)
        .collect(toCollection(LinkedHashSet::new));
  }


  private void checkWeightParameters(Set<ServerDetails> serverPool) {
    List<Integer> absoluteWeights = receiveAbsoluteWeights(serverPool);

    checkArgument(absoluteWeights.size() == weightPerGroup.size());

    int weightSum = absoluteWeights.stream().mapToInt(Integer::intValue)
        .sum();
    checkArgument(weightSum == MAX_WEIGHT_SUM);
  }


  private List<Integer> receiveAbsoluteWeights(Set<ServerDetails> serverPool) {
    return serverPool.stream().map(ServerDetails::getWeight)
        .filter(isWeightMoreThanZero()).collect(toList());
  }


  private Predicate<Integer> isWeightMoreThanZero() {
    return i -> i > 0;
  }


  private NavigableMap<Integer, String> receiveWeightedGroups(Set<ServerDetails> serverDetails) {
    NavigableMap<Integer, String> serverPool = new TreeMap<>();
    int totalWeight = 0;
    for (ServerDetails serverDetail : serverDetails) {
      totalWeight += serverDetail.getWeight();
      serverPool.put(totalWeight, serverDetail.getGroupName());
    }
    return serverPool;
  }
}
