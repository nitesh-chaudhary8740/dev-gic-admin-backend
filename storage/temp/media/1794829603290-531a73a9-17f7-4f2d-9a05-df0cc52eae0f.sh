# 1. Screen sessions list
screen -ls

# 2. Kaun logged in hai
who

# 3. Screen processes
ps aux | grep -E "SCREEN|screen" | grep -v grep