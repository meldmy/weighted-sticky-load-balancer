package com.github.meldmy.entity;

/**
 * @author Dmytro Melnychuk
 */
public class ServerDetails {

    private final String groupName;
    private final int weight;

    public ServerDetails(String groupName, int weight) {
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
        return groupName +  ":" + weight;
    }
}
