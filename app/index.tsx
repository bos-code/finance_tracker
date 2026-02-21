import { Text, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="mb-2 text-3xl font-bold text-blue-600">Welcome</Text>
      <Text className="text-center text-base text-slate-600">Finance Tracker is ready.</Text>
    </View>
  );
}
