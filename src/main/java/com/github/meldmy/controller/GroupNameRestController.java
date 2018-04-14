package com.github.meldmy.controller;

import com.github.meldmy.route.GroupRouter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * @author Dmytro Melnychuk
 */
@RestController
public class GroupNameRestController {

  private final GroupRouter groupRouter;

  public GroupNameRestController(GroupRouter groupRouter) {
    this.groupRouter = groupRouter;
  }

  @RequestMapping(value = "/route", method = RequestMethod.GET)
  public String getGroupName(@RequestParam("id") final String userId) {
    return groupRouter.receiveGroupName(userId);
  }
}
