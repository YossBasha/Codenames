with open('C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\server\\\\src\\\\socket\\\\roomManager.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("socket.emit('room_update', rooms[roomId]);", "socket.emit('room_update', getSafeRoom(rooms[roomId]));")
c = c.replace("io.to(roomId).emit('room_update', rooms[roomId]);", "io.to(roomId).emit('room_update', getSafeRoom(rooms[roomId]));")
c = c.replace("io.to(roomId).emit('room_update', room);", "io.to(roomId).emit('room_update', getSafeRoom(room));")

safe_room_func = """
function getSafeRoom(room: Room) {
  const { timerInterval, ...safeRoom } = room;
  return safeRoom;
}

export function setupRoomManager(io: Server) {
"""
c = c.replace("export function setupRoomManager(io: Server) {", safe_room_func)

with open('C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\server\\\\src\\\\socket\\\\roomManager.ts', 'w', encoding='utf-8') as f:
    f.write(c)
