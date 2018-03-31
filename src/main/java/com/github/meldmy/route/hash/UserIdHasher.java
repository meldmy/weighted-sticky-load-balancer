package com.github.meldmy.route.hash;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.google.common.hash.HashCode;
import com.google.common.hash.HashFunction;

/**
 * @author Dmytro Melnychuk
 */
public class UserIdHasher {

  private final HashFunction stringHashFunction;

  public UserIdHasher(HashFunction stringHashFunction) {
    this.stringHashFunction = stringHashFunction;
  }

  public long hash(String userId) {
    var hashCode = hashUserId(userId);
    return hashCode.asLong();
  }

  private HashCode hashUserId(String userId) {
    return stringHashFunction.hashString(userId, UTF_8);
  }
}
