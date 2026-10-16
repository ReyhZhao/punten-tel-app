from rest_framework import serializers

from .models import User


class AccountSerializer(serializers.ModelSerializer):
    displayName = serializers.CharField(source="display_name", max_length=40)

    class Meta:
        model = User
        fields = ["id", "email", "displayName"]
        read_only_fields = ["id", "email"]

    def validate_displayName(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Schermnaam mag niet leeg zijn.")
        return value


class RequestCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    displayName = serializers.CharField(max_length=40, required=False, allow_blank=True)


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^\s*\d{6}\s*$", error_messages={"invalid": "De code bestaat uit 6 cijfers."})
    deviceName = serializers.CharField(max_length=80, required=False, allow_blank=True)
