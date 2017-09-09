package com.github.meldmy.controller;

import com.github.meldmy.route.GroupRouter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static com.google.common.base.Preconditions.checkNotNull;

/**
 * @author Dmytro Melnychuk
 */
@RestController
public class GroupNameRestController {

    @Autowired private GroupRouter groupRouter;

    @RequestMapping(value = "/route", method = RequestMethod.GET)
    public String getGroupName(@RequestParam("id") final String userId) {
        checkNotNull(userId);
        return groupRouter.receiveGroupName(userId);
    }
}
