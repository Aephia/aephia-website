#!/bin/bash
# Collect all uniqueSlugs by paginating Medium's load-more API via web_fetch isn't available from bash
# Instead, save the first batch and we'll paginate from the main session
echo "Use web_fetch to paginate"
