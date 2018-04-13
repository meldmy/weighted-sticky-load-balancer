package com.github.meldmy.configuration.init;

import static com.google.common.base.Preconditions.checkArgument;
import static java.util.stream.Collectors.toCollection;

import com.github.meldmy.entity.ServerDetails;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;


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
    var agregatedServerDetails = new AggregatedServerDetails(serverPool);

    checkArgument(agregatedServerDetails.receiveGroupsCount() == weightPerGroup.size());
    checkArgument(agregatedServerDetails.receiveWeightSum() == MAX_WEIGHT_SUM);
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
