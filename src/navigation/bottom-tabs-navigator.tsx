import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import { palette } from "@/theme/colors";
import { Tabs } from "expo-router";

export function BottomTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: palette.canvas,
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
          title: "Ledger",
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
          title: "Insights",
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
