package com.github.meldmy.route.hash;

import static com.github.meldmy.util.TestDummies.DUMMY_FIRST_USER_ID;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Java6Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.google.common.hash.HashCode;
import com.google.common.hash.HashFunction;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

/**
 * @author Dmytro Melnychuk
 */
@RunWith(MockitoJUnitRunner.class)
public class UserIdHasherTest {

  @Mock
  private HashFunction stringHashFunction;
  @Mock
  private HashCode hashCode;
  @InjectMocks
  private UserIdHasher userIdHasher;

  @Test
  public void shouldReturnHashedUserId() {
    var expectedHashedUserId = hashCode.asLong();
    var givenUserId = DUMMY_FIRST_USER_ID;
    when(stringHashFunction.hashString(givenUserId, UTF_8)).thenReturn(hashCode);

    assertThat(userIdHasher.hash(givenUserId)).isEqualTo(expectedHashedUserId);
  }
}