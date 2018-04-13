package com.github.meldmy.configuration.init;

import static java.util.stream.Collectors.toList;

import com.github.meldmy.entity.ServerDetails;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

/**
 * @author Dmytro Melnychuk
 */
class AggregatedServerDetails {

  private final List<Integer> absoluteWeights;
  private final Set<ServerDetails> serverPool;

  public AggregatedServerDetails(Set<ServerDetails> serverPool) {
    this.serverPool = serverPool;
    absoluteWeights = receiveAbsoluteWeights();
  }

  private List<Integer> receiveAbsoluteWeights() {
    return serverPool.stream().map(ServerDetails::getWeight)
        .filter(isWeightMoreThanZero()).collect(toList());
  }

  private Predicate<Integer> isWeightMoreThanZero() {
    return i -> i > 0;
  }

  public int receiveGroupsCount() {
    return absoluteWeights.size();
  }

  public int receiveWeightSum() {
    return absoluteWeights.stream().reduce(0, Integer::sum);
  }
}
