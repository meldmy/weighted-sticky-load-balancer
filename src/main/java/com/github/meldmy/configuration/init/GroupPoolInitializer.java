package com.github.meldmy.configuration.init;

import com.github.meldmy.entity.ServerDetails;

import java.util.*;
import java.util.Map.Entry;
import java.util.function.Predicate;

import static com.google.common.base.Preconditions.checkArgument;
import static java.util.stream.Collectors.toList;

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
        Set<ServerDetails> pool = new LinkedHashSet<>();
        for (Entry<String, Integer> e : weightPerGroup.entrySet()) {
            ServerDetails serverDetails = new ServerDetails(e.getKey(), e.getValue());
            pool.add(serverDetails);
        }
        return pool;
    }

    private void checkWeightParameters(Set<ServerDetails> serverPool) {
        List<Integer> absoluteWeights = serverPool.stream()
                .map(ServerDetails::getWeight)
                .filter(isWeightMoreThanZero())
                .collect(toList());

        checkArgument(absoluteWeights.size() == weightPerGroup.size());

        int weightSum = absoluteWeights.stream().mapToInt(Integer::intValue).sum();
        checkArgument(weightSum == MAX_WEIGHT_SUM);
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
