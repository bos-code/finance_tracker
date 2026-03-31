import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import { Tabs } from "expo-router";

export function BottomTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: "#f4f6f9",
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="calender/index"
        options={{
          title: "Calendar",
        }}
      />
      <Tabs.Screen
        name="goals/index"
        options={{
          title: "Goals",
        }}
      />
      <Tabs.Screen
        name="chartpie/index"
        options={{
          title: "Stats",
        }}
      />
      <Tabs.Screen
        name="user/index"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
