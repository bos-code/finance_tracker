import { icons } from "@/constants/icons";
import { Tabs } from "expo-router";
import { Image, Text, View, type ImageSourcePropType } from "react-native";

type TabIconProps = {
  focused: boolean;
  icon: ImageSourcePropType;
  title: string;
};

function TabIcon({ focused, icon, title }: TabIconProps) {
  return (
    <View className="h-full w-full items-center justify-center">
      <View
        className={`h-11 w-11 items-center justify-center rounded-2xl ${
          focused ? "bg-[#1d4ed8]" : "bg-[#e8efff]"
        }`}>
        <Image
          source={icon}
          style={{
            width: 20,
            height: 20,
            opacity: focused ? 1 : 0.9,
            tintColor: focused ? "#ffffff" : "#1d4ed8",
          }}
        />
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className={`mb-3 mt-1 w-20 text-center text-[11px] font-semibold leading-none ${
          focused ? "text-[#1d4ed8]" : "text-[#64748b]"
        }`}>
        {title}
      </Text>
    </View>
  );
}

export function BottomTabsNavigator() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIconStyle: {
          margin: 0,
          alignSelf: "center",
        },
        tabBarItemStyle: {
          width: "auto",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
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
          borderColor: "#cfe0ff",
        },
      }}>
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Rev/Exp",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.home} title="Rev/Exp" />
          ),
        }}
      />
      <Tabs.Screen
        name="calender/index"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.calendar} title="Calendar" />
          ),
        }}
      />
      <Tabs.Screen
        name="chartpie/index"
        options={{
          title: "Statistical",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.chartpie} title="Statistical" />
          ),
        }}
      />
      <Tabs.Screen
        name="user/index"
        options={{
          title: "Individual",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.user} title="Individual" />
          ),
        }}
      />
    </Tabs>
  );
}
