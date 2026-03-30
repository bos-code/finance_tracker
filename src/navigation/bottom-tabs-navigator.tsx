import { icons } from "@/constants/icons";
import { useAppStore } from "@/store/use-app-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Image, Text, View, type ImageSourcePropType } from "react-native";

type TabIconProps = {
  focused: boolean;
  title: string;
  primary: string;
  icon?: ImageSourcePropType;
  iconName?: string;
};

function TabIcon({ focused, icon, iconName, title, primary }: TabIconProps) {
  return (
    <View className="h-full w-full flex items-center justify-center">
      <View
        style={{
          height: 42,
          width: 42,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          backgroundColor: focused ? primary : primary + "18",
        }}
      >
        {icon ? (
          <Image
            source={icon}
            style={{
              width: 19,
              height: 19,
              opacity: focused ? 1 : 0.88,
              tintColor: focused ? "#ffffff" : primary,
            }}
          />
        ) : (
          <MaterialCommunityIcons
            name={(iconName || "circle-outline") as any}
            size={21}
            color={focused ? "#ffffff" : primary}
          />
        )}
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          marginTop: 4,
          marginBottom: 10,
          width: 64,
          fontSize: 10.5,
          textAlign: "center",
          fontWeight: "700",
          color: focused ? primary : "#64748b",
        }}
      >
        {title}
      </Text>
    </View>
  );
}

export function BottomTabs() {
  const theme = useAppStore((state) => state.theme);
  const primary = theme.primary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIconStyle: { margin: 0, alignSelf: "center" },
        tabBarItemStyle: {
          flex: 1,
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 16,
        },
        tabBarStyle: {
          backgroundColor: "#f8faff",
          height: 88,
          paddingTop: 0,
          paddingHorizontal: 4,
          position: "absolute",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: primary + "24",
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.home} title="Home" primary={primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="calender/index"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={icons.calendar}
              title="Calendar"
              primary={primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals/index"
        options={{
          title: "Goals",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconName="target"
              title="Goals"
              primary={primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chartpie/index"
        options={{
          title: "Stats",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={icons.chartpie}
              title="Stats"
              primary={primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="user/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.user} title="Profile" primary={primary} />
          ),
        }}
      />
    </Tabs>
  );
}
