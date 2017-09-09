# Weighted sticky load balancer

This is simple REST load balancer that is able to route traffic to different backends depending on a group that user falls into. 

Once we assign group to the user then client connects to any backend server at any time the user experience is unaffected. This is achieved by storing usernames mapped to assigned group name.

**Load balancer isn't session-aware** and stores hashed usernames, that's why it can work with the system that doesn't store HTTP cookie. 

**Load balancer uses WRR algorithm** for divide traffic between server groups.

