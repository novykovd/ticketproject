import { View, Text, Button } from 'react-native'
import { useState } from 'react'
import * as Location from 'expo-location';

export default function App() {
  const [response, setResponse] = useState(null)

  const callServer = async () => {
    try {
      const res = await fetch('http://localhost:3000')
      const data = await res.json()
      setResponse(JSON.stringify(data))
    } catch (err) {
      console.error(err)
    }
  }

  const sendLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission denied');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});

    const payload = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    };

    await fetch('http://localhost:3000/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Sent:', payload);
  };

  return (
    <View style={{ padding: 40 }}>
      <Button title="Call Server" onPress={callServer} />
      <Text>{response}</Text>
      <Button title="Send Location" onPress={sendLocation} />
    </View>
  )
}