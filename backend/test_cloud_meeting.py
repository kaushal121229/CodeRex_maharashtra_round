import asyncio
import json
import httpx
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"

async def test_full_cloud_meeting_lifecycle():
    print("==================================================")
    print("STARTING REAL CLOUD MEETING E2E VERIFICATION TEST")
    print("==================================================")

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. CREATE MEETING
        print("\n[Step 1] Host creates meeting...")
        res = await client.post("/rooms", json={"host_name": "Saish (Host)", "title": "Quarterly Planning"})
        assert res.status_code == 200, f"Create room failed: {res.text}"
        room_data = res.json()
        room_id = room_data["room_id"]
        host_participant = room_data["host_participant"]
        host_id = host_participant["participant_id"]
        print(f" Room created: Room ID = {room_id}")
        print(f" Host: {host_participant['display_name']} ({host_id})")
        print(f" Join URL: {room_data['join_url']}")

        # 2. GET ROOM STATE
        print("\n[Step 2] Fetching room state...")
        res = await client.get(f"/rooms/{room_id}")
        assert res.status_code == 200
        state = res.json()
        assert state["room_id"] == room_id
        assert state["status"] == "active"
        print(f" Room status is active. Participants: {len(state['participants'])}")

        # 3. PARTICIPANTS JOIN
        print("\n[Step 3] Phone 1 (Rahul) joins room via REST join...")
        res = await client.post(f"/rooms/{room_id}/join", json={
            "display_name": "Rahul",
            "device_id": "phone-android-rahul"
        })
        assert res.status_code == 200
        rahul_data = res.json()
        rahul_id = rahul_data["participant_id"]
        print(f" Rahul joined with participant_id = {rahul_id}")

        print("\n[Step 4] Phone 2 (Aman) joins room via REST join...")
        res = await client.post(f"/rooms/{room_id}/join", json={
            "display_name": "Aman",
            "device_id": "phone-ios-aman"
        })
        assert res.status_code == 200
        aman_data = res.json()
        aman_id = aman_data["participant_id"]
        print(f" Aman joined with participant_id = {aman_id}")

        # 4. WEBSOCKET TEST WITH MULTIPLE CLIENTS
        print("\n[Step 5] Connecting Host and Rahul over WebSocket...")
        host_ws_uri = f"{WS_URL}/ws/{room_id}"
        rahul_ws_uri = f"{WS_URL}/ws/{room_id}"

        async with websockets.connect(host_ws_uri) as host_ws:
            # Host joins WS
            await host_ws.send(json.dumps({
                "type": "join_room",
                "room_id": room_id,
                "participant_id": host_id,
                "display_name": "Saish (Host)",
                "device_id": "host-laptop",
                "role": "host"
            }))
            host_join_ack = json.loads(await host_ws.recv())
            print(f" Host WS event received: {host_join_ack.get('type')}")
            assert host_join_ack["type"] == "room_joined"

            async with websockets.connect(rahul_ws_uri) as rahul_ws:
                # Rahul joins WS
                await rahul_ws.send(json.dumps({
                    "type": "join_room",
                    "room_id": room_id,
                    "participant_id": rahul_id,
                    "display_name": "Rahul",
                    "device_id": "phone-android-rahul"
                }))

                # Rahul receives room_joined
                rahul_ack = json.loads(await rahul_ws.recv())
                print(f" Rahul WS event received: {rahul_ack.get('type')}")
                assert rahul_ack["type"] == "room_joined"

                # Host should receive participant_joined for Rahul
                host_evt = json.loads(await host_ws.recv())
                print(f" Host received broadcast: {host_evt.get('type')} -> {host_evt.get('display_name')} joined")
                assert host_evt["type"] == "participant_joined"
                assert host_evt["participant_id"] == rahul_id

                # Rahul sends heartbeat
                await rahul_ws.send(json.dumps({
                    "type": "heartbeat",
                    "room_id": room_id,
                    "participant_id": rahul_id
                }))
                rahul_hb_ack = json.loads(await rahul_ws.recv())
                assert rahul_hb_ack["type"] == "heartbeat_ack"
                print(f" Heartbeat verified for Rahul")

            # Rahul disconnected from WS. Let's verify reconnection with SAME ID!
            print("\n[Step 6] Testing Reconnection: Rahul reconnects with SAME participant_id...")
            async with websockets.connect(rahul_ws_uri) as rahul_reconnect_ws:
                await rahul_reconnect_ws.send(json.dumps({
                    "type": "reconnect",
                    "room_id": room_id,
                    "participant_id": rahul_id,
                    "display_name": "Rahul",
                    "device_id": "phone-android-rahul"
                }))

                reconnect_ack = json.loads(await rahul_reconnect_ws.recv())
                print(f" Rahul reconnect ACK: {reconnect_ack.get('type')} (participant_id: {reconnect_ack.get('participant_id')})")
                assert reconnect_ack["type"] == "room_joined"
                assert reconnect_ack["participant_id"] == rahul_id, "Participant ID must NOT change on reconnect!"

                # Host receives participant_reconnected or participant_joined
                reconnect_broadcast = json.loads(await host_ws.recv())
                print(f" Host received broadcast: {reconnect_broadcast.get('type')} for {reconnect_broadcast.get('display_name')}")
                assert reconnect_broadcast["participant_id"] == rahul_id

                # 5. HOST ENDS MEETING
                print("\n[Step 7] Host ends the meeting...")
                end_res = await client.post(f"/rooms/{room_id}/end", json={"host_id": host_id})
                assert end_res.status_code == 200
                print(f" Host ended room via API.")

                # Both Host and Rahul should receive meeting_ended event
                rahul_end_evt = json.loads(await rahul_reconnect_ws.recv())
                print(f" Rahul received event: {rahul_end_evt.get('type')} - '{rahul_end_evt.get('message')}'")
                assert rahul_end_evt["type"] == "meeting_ended"

        # Verify Room is marked ended
        res_after = await client.get(f"/rooms/{room_id}")
        assert res_after.json()["status"] == "ended"
        print(f" Room {room_id} status verified as ended in DB.")

    print("\n==================================================")
    print(" ALL CLOUD MEETING CHECKS PASSED SUCCESSFULLY! ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(test_full_cloud_meeting_lifecycle())
