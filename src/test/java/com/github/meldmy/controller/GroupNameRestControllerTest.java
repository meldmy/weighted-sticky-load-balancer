package com.github.meldmy.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.github.meldmy.WeightedLoadBalancerApplication;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.context.WebApplicationContext;

/**
 * @author Dmytro Melnychuk
 */
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(classes = WeightedLoadBalancerApplication.class)
@WebAppConfiguration
public class GroupNameRestControllerTest {

  private MockMvc mockMvc;
  @Autowired
  private WebApplicationContext webApplicationContext;

  @Before
  public void setUp() {
    mockMvc = webAppContextSetup(webApplicationContext).build();
  }

  @Test
  public void shouldReceiveGroupNameWhenInvokeRouteWithUserId() throws Exception {
    var givenUserId = "dummy_user";

    MvcResult response = mockMvc.perform(get("/route").param("id", givenUserId))
        .andExpect(status().isOk())
        .andExpect(content().contentType("text/plain;charset=UTF-8"))
        .andReturn();

    assertThat(response.getResponse().getContentAsString()).startsWith("group");
  }
}