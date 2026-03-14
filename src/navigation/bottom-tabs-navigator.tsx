import { icons } from "@/constants/icons";
import { useAppStore } from "@/store/use-app-store";
import { Tabs } from "expo-router";
import { Image, Text, View, type ImageSourcePropType } from "react-native";

type TabIconProps = {
  focused: boolean;
  icon: ImageSourcePropType;
  title: string;
  primary: string;
};

function TabIcon({ focused, icon, title, primary }: TabIconProps) {
  return (
    <View className="h-full w-full flex items-center justify-center">
      <View
        style={{
          height: 44, width: 44,
          alignItems: "center", justifyContent: "center",
          borderRadius: 14,
          backgroundColor: focused ? primary : primary + "20",
        }}
      >
        <Image
          source={icon}
          style={{
            width: 20, height: 20,
            opacity: focused ? 1 : 0.85,
            tintColor: focused ? "#ffffff" : primary,
          }}
        />
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          marginTop: 4, marginBottom: 12,
          width: 80, fontSize: 11,
          textAlign: "center", fontWeight: "600",
          color: focused ? primary : "#64748b",
        }}
      >
        {title}
      </Text>
    </View>
  );
}

export function BottomTabs() {
  const theme = useAppStore((s) => s.theme);
  const primary = theme.primary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIconStyle: { margin: 0, alignSelf: "center" },
        tabBarItemStyle: {
          width: "auto", height: "100%",
          justifyContent: "center", alignItems: "center",
          paddingTop: 20,
        },
        tabBarStyle: {
          backgroundColor: "#f8faff",
          marginHorizontal: 0,
          height: 90,
          paddingTop: 0,
          position: "absolute",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: primary + "30",
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Rev/Exp",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.home} title="Rev/Exp" primary={primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="calender/index"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.calendar} title="Calendar" primary={primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="chartpie/index"
        options={{
          title: "Statistical",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.chartpie} title="Statistical" primary={primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="user/index"
        options={{
          title: "Individual",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.user} title="Individual" primary={primary} />
          ),
        }}
      />
    </Tabs>
  );
}
